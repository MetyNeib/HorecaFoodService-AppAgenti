require "rails_helper"
require "sidekiq/testing"
require_relative "../support/amelia3_fixture"

RSpec.describe "Amelia3 read-only FTP and daily scheduling" do
  include Amelia3Fixture
  let(:env) { { "AMELIA3_FTP_HOST" => "fake.test.invalid", "AMELIA3_FTP_USERNAME" => "synthetic", "AMELIA3_FTP_PASSWORD" => "fake-for-tests", "AMELIA3_FTP_SYNC_ENABLED" => "true" } }
  let(:settings) { Amelia3::FtpSettings.new(env) }
  let(:directory) { csv_fixture }
  let(:root) { Dir.mktmpdir("hfs-ftp-test-") }
  let(:ftp) { double("read only FTP") }
  after { FileUtils.remove_entry(directory); FileUtils.remove_entry(root) }

  before do
    allow(ftp).to receive(:open_timeout=)
    allow(ftp).to receive(:read_timeout=)
    allow(ftp).to receive(:passive=)
    allow(ftp).to receive(:connect)
    allow(ftp).to receive(:login)
    allow(ftp).to receive(:chdir).with("/UPLOAD")
    allow(ftp).to receive(:pwd).and_return("/UPLOAD")
    allow(ftp).to receive(:nlst).and_return(Amelia3::Schema::HEADERS.keys)
    allow(ftp).to receive(:close)
    allow(ftp).to receive(:size) { |name| File.size(File.join(directory, name)) }
    allow(ftp).to receive(:mtime).and_return(Time.utc(2026, 10, 12, 4))
    allow(ftp).to receive(:retrbinary) { |command, _, &block| block.call(File.binread(File.join(directory, command.delete_prefix("RETR ")))) }
  end

  def download
    Amelia3::FtpDownloader.new(settings: settings, ftp: ftp, root: root, probe_seconds: 0).call
  end

  it "downloads all nine files with matching checksums using only read operations" do
    result = download
    expect(result[:read_only]).to be(true)
    expect(result[:encrypted]).to be(false)
    expect(result[:files].keys).to match_array(Amelia3::Schema::HEADERS.keys)
    result[:files].each { |name, info| expect(info[:sha256]).to eq(Digest::SHA256.file(File.join(directory, name)).hexdigest) }
    expect(ftp).to have_received(:retrbinary).exactly(9).times
    expect(ftp).not_to respond_to(:putbinaryfile)
  end

  it "rejects missing files and write-enabled configuration" do
    allow(ftp).to receive(:nlst).and_return([ "CLIENTI.csv" ])
    expect { download }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("FTP_MISSING_FILE") }
    expect { Amelia3::FtpSettings.new(env.merge("AMELIA3_FTP_WRITE_ENABLED" => "true")) }.to raise_error(Amelia3::Error)
  end

  it "rejects changing metadata, truncated data and interrupted connections" do
    allow(ftp).to receive(:size).with("ARTICOLI.csv").and_return(500, 501)
    expect { download }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("FTP_UNSTABLE") }
    allow(ftp).to receive(:size).with("ARTICOLI.csv").and_return(File.size(File.join(directory, "ARTICOLI.csv")))
    allow(ftp).to receive(:retrbinary) { |_, _, &block| block.call("short") }
    expect { download }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("FTP_TRUNCATED") }
    allow(ftp).to receive(:connect).and_raise(Timeout::Error, "sensitive fake hostname")
    expect { download }.to raise_error(Amelia3::Error) { |error| expect(error.message).not_to include("sensitive"); expect(error.cause).to be_nil }
  end

  it "compares complete content twice if the server cannot provide MDTM" do
    allow(ftp).to receive(:mtime).and_raise(Net::FTPPermError)
    expect(download[:files].length).to eq(9)
    expect(ftp).to have_received(:retrbinary).exactly(18).times
  end

  it "calculates 06:05 Rome with the correct UTC offsets across both DST transitions" do
    expect(Amelia3::Scheduler.scheduled_at(Date.new(2026, 3, 28)).utc.hour).to eq(5)
    expect(Amelia3::Scheduler.scheduled_at(Date.new(2026, 3, 29)).utc.hour).to eq(4)
    expect(Amelia3::Scheduler.scheduled_at(Date.new(2026, 10, 24)).utc.hour).to eq(4)
    expect(Amelia3::Scheduler.scheduled_at(Date.new(2026, 10, 25)).utc.hour).to eq(5)
  end

  it "registers a single daily occurrence and queue item across repeated ticks" do
    fixture = commercial_fixture
    fixture[:tenant].update!(code: "amelia3")
    Sidekiq::Testing.fake! do
      allow(Sidekiq).to receive(:redis).and_yield(double(call: true))
      2.times { Amelia3::Scheduler.tick(Time.utc(2026, 10, 12, 5), settings: settings) }
      expect(Amelia3::SyncOccurrence.where(tenant: fixture[:tenant]).count).to eq(1)
      expect(Amelia3::SyncJob.jobs.length).to eq(1)
      expect(Amelia3::SyncOccurrence.sole.scheduled_at.in_time_zone("Europe/Rome").strftime("%H:%M")).to eq("06:05")
      Amelia3::SyncJob.clear
    end
    FileUtils.remove_entry(fixture[:directory])
  end

  it "keeps scheduling disabled when explicitly configured so" do
    expect(Amelia3::Scheduler.tick(Time.current, settings: Amelia3::FtpSettings.new(env.merge("AMELIA3_FTP_SYNC_ENABLED" => "false")))).to be_nil
  end
end
