require "rails_helper"
require_relative "../support/amelia3_fixture"

RSpec.describe Amelia3::SyncJob do
  include Amelia3Fixture
  let(:fixture) { commercial_fixture }
  let(:occurrence) { Amelia3::SyncOccurrence.create!(tenant: fixture[:tenant], local_date: Time.zone.today, scheduled_at: Amelia3::Scheduler.scheduled_at(Time.zone.today)) }
  let(:settings) { Amelia3::FtpSettings.new({ "AMELIA3_FTP_HOST" => "fake.invalid", "AMELIA3_FTP_USERNAME" => "synthetic", "AMELIA3_FTP_PASSWORD" => "fake", "AMELIA3_FTP_SYNC_ENABLED" => "true" }) }
  let(:files) { Amelia3::Schema::HEADERS.keys.to_h { |name| [ name, { sha256: Digest::SHA256.file(File.join(fixture[:directory], name)).hexdigest, bytes: File.size(File.join(fixture[:directory], name)) } ] } }
  after { FileUtils.remove_entry(fixture[:directory]) }
  before do
    allow(Amelia3::FtpSettings).to receive(:new).and_return(settings)
    allow(Amelia3::FtpDownloader).to receive(:new).and_return(double(call: { directory: fixture[:directory], files: files }))
  end

  it "records transfer evidence and treats repeated daily execution as one logical success" do
    2.times { described_class.new.perform(occurrence.id) }
    expect(occurrence.reload).to have_attributes(status: "success", attempts: 1, batch_id: fixture[:batch].id)
    expect(occurrence.source_files.keys.length).to eq(9)
    expect(occurrence.duration_ms).to be >= 0
    expect(Amelia3::FtpDownloader).to have_received(:new).once
    expect(fixture[:tenant].reload.revision).to eq(1)
  end

  it "records a sanitized interruption without publishing or removing the active dataset" do
    allow(Amelia3::FtpDownloader).to receive(:new).and_raise(Amelia3::Error.new("Trasferimento interrotto", code: "FTP_TRANSFER_FAILED"))
    expect { described_class.new.perform(occurrence.id) }.to raise_error(Amelia3::Error)
    expect(occurrence.reload).to have_attributes(status: "retrying", error_code: "FTP_TRANSFER_FAILED", attempts: 1)
    expect(fixture[:tenant].reload.active_batch_id).to eq(fixture[:batch].id)
    allow(Amelia3::FtpDownloader).to receive(:new).and_return(double(call: { directory: fixture[:directory], files: files }))
    described_class.new.perform(occurrence.id)
    expect(occurrence.reload).to have_attributes(status: "success", attempts: 2)
  end

  it "denies concurrent publication through the PostgreSQL tenant lock" do
    row = occurrence
    connection = ApplicationRecord.connection
    allow(connection).to receive(:select_value).and_call_original
    allow(connection).to receive(:select_value).with("SELECT pg_try_advisory_lock(#{730_000_000 + row.tenant_id})").and_return(false)
    expect { described_class.new.perform(row.id) }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("IMPORT_BUSY") }
    expect(Amelia3::FtpDownloader).not_to have_received(:new)
    expect(fixture[:tenant].reload.active_batch_id).to eq(fixture[:batch].id)
  end

  it "does not connect when the scheduler is disabled and marks terminal failures accurately" do
    allow(settings).to receive(:enabled?).and_return(false)
    described_class.new.perform(occurrence.id)
    expect(occurrence.reload.status).to eq("disabled")
    expect(Amelia3::FtpDownloader).not_to have_received(:new)
    described_class.sidekiq_retries_exhausted_block.call({ "args" => [ occurrence.id ] }, nil)
    expect(occurrence.reload.status).to eq("failed")
  end
end
