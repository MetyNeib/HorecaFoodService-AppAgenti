require "rails_helper"
require_relative "../support/amelia3_fixture"

RSpec.describe Amelia3::Importer do
  include Amelia3Fixture
  let(:tenant) { Amelia3::Tenant.create!(code: "test", name: "Tenant sintetico") }
  let(:directory) { csv_fixture }
  after { FileUtils.remove_entry(directory) if File.directory?(directory) }

  it "streams all entities with exact decimal values and nullable reference dates" do
    batch = described_class.call(tenant: tenant, directory: directory)
    expect(batch.status).to eq("published")
    expect(tenant.reload.active_batch_id).to eq(batch.id)
    expect(batch.counts["CLIENTI.csv"]).to eq(3)
    expect(Amelia3::Price.find_by!(batch_id: batch.id, product_code: "P001").amount).to eq(BigDecimal("1.23456"))
    expect(Amelia3::OpenItem.find_by!(batch_id: batch.id).reference_date).to be_nil
    expect(Amelia3::Credit.find_by!(batch_id: batch.id).remaining).to eq(-5)
    expect(batch.metrics["agent34"].slice("customers", "unblocked", "blocked", "rows", "orders", "products")).to eq(
      "customers" => 2, "unblocked" => 1, "blocked" => 1, "rows" => 1, "orders" => 1, "products" => 1)
  end

  it "publishes validated staging and repeats imports without duplication" do
    dry = described_class.call(tenant: tenant, directory: directory, dry_run: true)
    expect(tenant.reload.active_batch_id).to be_nil
    first = described_class.call(tenant: tenant, directory: directory)
    second = described_class.call(tenant: tenant, directory: directory)
    expect([ dry.id, first.id, second.id ].uniq.length).to eq(1)
    expect(tenant.reload.revision).to eq(1)
    expect(Amelia3::HistoryRow.where(batch_id: first.id).count).to eq(2)
  end

  it "retains the prior published dataset when the last file is corrupt" do
    previous = described_class.call(tenant: tenant, directory: directory)
    File.open(File.join(directory, "TABGIR.csv"), "a") { |file| file.puts "bad;row;" }
    expect { described_class.call(tenant: tenant, directory: directory) }.to raise_error(Amelia3::Error)
    expect(tenant.reload.active_batch_id).to eq(previous.id)
    expect(Amelia3::Customer.where(batch_id: previous.id).count).to eq(3)
    expect(tenant.import_batches.where(status: "failed").count).to eq(1)
  end

  it "rejects incomplete batches before publication" do
    File.delete(File.join(directory, "STORICO.csv"))
    expect { described_class.call(tenant: tenant, directory: directory) }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("MISSING_FILE") }
    expect(tenant.reload.active_batch_id).to be_nil
  end

  it "rejects orphan codes and malformed dates instead of silently dropping rows" do
    path = File.join(directory, "STORICO.csv")
    text = File.read(path).sub("C001", "UNASSIGNED").sub("01/10/2026", "31/02/2026")
    File.write(path, text)
    expect { described_class.call(tenant: tenant, directory: directory) }.to raise_error(Amelia3::Error)
    expect(tenant.reload.active_batch_id).to be_nil
  end
end
