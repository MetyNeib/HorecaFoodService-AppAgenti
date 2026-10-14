require "rails_helper"
require "sidekiq/testing"
require_relative "../support/amelia3_fixture"

RSpec.describe Amelia3::SalesAlerts do
  include Amelia3Fixture
  let(:fixture) { commercial_fixture }
  let(:tenant) { fixture[:tenant] }
  let(:day) { Date.new(2026, 10, 12) }
  after { FileUtils.remove_entry(fixture[:directory]) }

  def rules(products, date = day, blocked = [])
    Amelia3::SalesAlertRules.call(product_dates: products.transform_values { |offsets| offsets.map { |n| (day - n).iso8601 } }, as_of: date, blocked_products: blocked)
  end

  def publish(events, blocked_customer: false, blocked_product: false, agent: "34")
    original = fixture[:batch]
    files = original.files.deep_dup
    files["STORICO.csv"]["sha256"] = Digest::SHA256.hexdigest(JSON.generate(events))
    batch = tenant.import_batches.create!(fingerprint: SecureRandom.hex(32), source: "isolated-test", status: "published", files: files)
    [ Amelia3::Customer, Amelia3::Product ].each do |model|
      model.where(batch_id: original.id).each { |row| model.create!(row.attributes.except("id", "batch_id").merge(batch_id: batch.id)) }
    end
    Amelia3::Customer.find_by!(batch_id: batch.id, external_code: "C001").update!(blocked: blocked_customer, agent_code: agent)
    Amelia3::Product.find_by!(batch_id: batch.id, external_code: "P001").update!(blocked: blocked_product)
    events.each_with_index do |event, index|
      Amelia3::HistoryRow.create!(batch: batch, source_row: index + 1, customer_code: event.fetch(:customer, "C001"), product_code: event.fetch(:product, "P001"),
        order_reference: event.fetch(:reference, "R#{index}"), delivery_date: day - event.fetch(:ago), packs: 1, pieces: 1, weight: 1, shipped: event.fetch(:shipped, 1))
    end
    tenant.update!(active_batch: batch)
    batch
  end

  def stopped_events
    [ 120, 100, 80, 60 ].map.with_index { |ago, index| { ago: ago, reference: "ORDER-#{index}" } }
  end

  it "uses exact medians, inclusive thresholds, span and stopped suppression" do
    stopped = rules({ "P" => [ 120, 100, 80, 60 ] })
    expect(stopped.map { |row| row[:rule_type] }).to eq([ "CUSTOMER_STOPPED" ])
    expect(stopped.first[:evidence]).to include("thresholdDays" => 50, "daysLate" => 10)
    expect(rules({ "P" => [ 110, 90, 70, 50 ] }).first[:evidence]["daysLate"]).to eq(0)
    expect(rules({ "P" => [ 109, 89, 69, 49 ] })).to be_empty
    expect(rules({ "P" => [ 40, 39, 38, 37 ] })).to be_empty
  end

  it "requires five distinct product dates across months, a later different purchase and at most 180 days" do
    product = [ 100, 90, 80, 70, 60 ]
    expect(rules({ "P" => product, "Q" => [ 2 ] }).map { |row| row[:rule_type] }).to eq([ "USUAL_PRODUCT_MISSING" ])
    expect(rules({ "P" => product.drop(1) + [ 60 ], "Q" => [ 2 ] })).to be_empty
    expect(rules({ "P" => [ 100, 99, 98, 97, 96 ], "Q" => [ 2 ] })).to be_empty
    expect(rules({ "P" => product, "Q" => [ 61 ] }).none? { |row| row[:rule_type] == "USUAL_PRODUCT_MISSING" }).to be(true)
    expect(rules({ "P" => [ 220, 210, 200, 190, 180 ], "Q" => [ 2 ] }).first[:rule_type]).to eq("USUAL_PRODUCT_MISSING")
    expect(rules({ "P" => [ 221, 211, 201, 191, 181 ], "Q" => [ 2 ] })).to be_empty
    expect(rules({ "P" => product, "Q" => [ 2 ] }, day, [ "P" ])).to be_empty
  end

  it "orders tied missing products by code and caps the list at five" do
    products = (1..7).to_h { |n| [ "P#{n}", [ 100, 90, 80, 70, 60 ] ] }.merge("Q" => [ 2 ])
    expect(rules(products).map { |row| row[:product_code] }).to eq(%w[P1 P2 P3 P4 P5])
  end

  it "uses the two exact frequency inequalities and excludes zero recent purchases" do
    previous = (0...12).map { |n| 230 - n * 14 }
    expect(rules({ "P" => previous + [ 3 ] }).last[:rule_type]).to eq("PURCHASE_FREQUENCY_DROP")
    expect(rules({ "P" => previous + [ 3, 4, 5 ] }).none? { |row| row[:rule_type] == "PURCHASE_FREQUENCY_DROP" }).to be(true)
    expect(rules({ "P" => previous }).none? { |row| row[:rule_type] == "PURCHASE_FREQUENCY_DROP" }).to be(true)
  end

  it "keeps reactivation beyond the twelve-month window and includes future dates only after their day" do
    leap = Date.new(2024, 2, 29)
    values = { "P" => %w[2023-02-28 2023-03-20 2023-04-10 2023-05-01] }
    expect(Amelia3::SalesAlertRules.call(product_dates: values, as_of: leap).first[:rule_type]).to eq("CUSTOMER_REACTIVATION")
    expect(Amelia3::SalesAlertRules.call(product_dates: values, as_of: leap + 366).first[:rule_type]).to eq("CUSTOMER_REACTIVATION")
    values["Q"] = [ leap.iso8601 ]
    expect(Amelia3::SalesAlertRules.call(product_dates: values, as_of: leap).first[:rule_type]).to eq("CUSTOMER_REACTIVATION")
    expect(Amelia3::SalesAlertRules.call(product_dates: values, as_of: leap + 1)).to be_empty
  end

  it "classifies only after 90 days, suppresses all sales alerts and leaves unknown history unclassified" do
    expect(rules({ "P" => [ 150, 130, 110, 90 ] }).map { |row| row[:rule_type] }).to eq([ "CUSTOMER_STOPPED" ])
    expect(rules({ "P" => [ 151, 131, 111, 91 ] }).map { |row| row[:rule_type] }).to eq([ "CUSTOMER_REACTIVATION" ])
    expect(rules({ "P" => [ 500 ] }).sole[:evidence]).to include("daysSinceLast" => 500, "lastDelivery" => (day - 500).iso8601)
    expect(rules({ "P" => [] })).to be_empty
    expect(rules({ "P" => [ -1 ] })).to be_empty
    expect(rules({ "P" => [ 180, 170, 160, 150, 140 ], "Q" => [ 91 ] }).map { |row| row[:rule_type] }).to eq([ "CUSTOMER_REACTIVATION" ])
  end

  it "separates reactivation by portfolio and resolves it after a real positive delivery" do
    publish([ { ago: 400 }, { ago: 1, shipped: 0 }, { ago: 2, shipped: -1 }, { ago: -1 } ])
    result = described_class.call(tenant: tenant, as_of: day)
    expect(result.metrics["counts"]["CUSTOMER_REACTIVATION"]).to eq(1)
    scope = Amelia3::Scope.new(fixture[:agent])
    expect(Amelia3::AlertPage.new(scope, {}).total).to eq(0)
    expect(Amelia3::AlertPage.new(scope, { type: "CUSTOMER_REACTIVATION" }).items.sole.evidence["daysSinceLast"]).to eq(400)
    expect(described_class.call(tenant: tenant, as_of: day, full: true).metrics["identical"]).to be(true)
    publish([ { ago: 400 }, { ago: 1 } ])
    updated = described_class.call(tenant: tenant, as_of: day)
    expect(updated.run.items.where(status: "active", rule_type: "CUSTOMER_REACTIVATION")).to be_empty
    expect(updated.run.items.where(status: "resolved", rule_type: "CUSTOMER_REACTIVATION").count).to eq(1)
    expect(described_class.call(tenant: tenant, as_of: day, full: true).metrics["identical"]).to be(true)
    publish([ { ago: 91 } ], blocked_customer: true, agent: "99")
    described_class.call(tenant: tenant, as_of: day)
    expect(Amelia3::AlertPage.new(Amelia3::Scope.new(fixture[:agent]), { type: "CUSTOMER_REACTIVATION" }).total).to eq(0)
    expect(Amelia3::AlertPage.new(Amelia3::Scope.new(fixture[:admin]), { type: "CUSTOMER_REACTIVATION" }).total).to eq(0)
  end

  it "reuses unchanged profiles, ignores row positions, and matches full recompute exactly" do
    first_batch = publish(stopped_events)
    first = described_class.call(tenant: tenant, as_of: day)
    expect(first.metrics["counts"]["CUSTOMER_STOPPED"]).to eq(1)
    expect(first.metrics["sourceRowsScanned"]).to eq(4)
    expect(described_class.call(tenant: tenant, as_of: day).metrics["mode"]).to eq("idempotent")
    reordered = publish(stopped_events.reverse)
    incremental = described_class.call(tenant: tenant, as_of: day)
    expect(incremental.metrics["profilesBuilt"]).to eq(0)
    expect(incremental.metrics["evaluationsReused"]).to eq(1)
    expect(reordered.reload.history_profile_set.profiles.sole.id).to eq(first_batch.reload.history_profile_set.profiles.sole.id)
    expect(incremental.run.result_digest).to eq(first.run.result_digest)
    expect(described_class.call(tenant: tenant, as_of: day, full: true).metrics["identical"]).to be(true)
  end

  it "detects duplicates, corrections, deletions, noncontiguous clients and nonpositive quantities" do
    events = stopped_events + [ { customer: "C003", ago: 5, reference: "OTHER", shipped: 0 } ]
    first_batch = publish(events)
    described_class.call(tenant: tenant, as_of: day)
    original = first_batch.reload.history_profile_set.profiles.find_by!(customer_code: "C001")
    changed = publish([ events[0], events[-1], *events[1...-1], events[0] ])
    duplicated = described_class.call(tenant: tenant, as_of: day)
    profile = changed.reload.history_profile_set.profiles.find_by!(customer_code: "C001")
    expect(profile.digest).not_to eq(original.digest)
    expect(profile.product_dates).to eq(original.product_dates)
    expect(duplicated.run.items.where(status: "active").count).to eq(1)
    expect(described_class.call(tenant: tenant, as_of: day, full: true).metrics["identical"]).to be(true)
    publish(stopped_events.take(3).map { |event| event.merge(shipped: -1) })
    result = described_class.call(tenant: tenant, as_of: day)
    expect(result.run.items.where(status: "active")).to be_empty
    expect(result.run.items.where(status: "resolved").count).to eq(1)
    expect(described_class.call(tenant: tenant, as_of: day, full: true).metrics["identical"]).to be(true)
  end

  it "reevaluates aging without scanning history and respects current assignment and blocks" do
    batch = publish(stopped_events)
    first = described_class.call(tenant: tenant, as_of: day - 11)
    expect(first.run.items.where(status: "active")).to be_empty
    later = described_class.call(tenant: tenant, as_of: day)
    expect(later.metrics["sourceRowsScanned"]).to eq(0)
    expect(later.run.items.where(status: "active").count).to eq(1)
    publish(stopped_events, agent: "99")
    reassigned = described_class.call(tenant: tenant, as_of: day)
    expect(reassigned.metrics["sourceRowsScanned"]).to eq(0)
    expect(Amelia3::AlertPage.new(Amelia3::Scope.new(fixture[:agent]), {}).total).to eq(0)
    expect(Amelia3::AlertPage.new(Amelia3::Scope.new(fixture[:admin]), {}).total).to eq(1)
    publish(stopped_events, blocked_customer: true)
    expect(described_class.call(tenant: tenant, as_of: day).run.items.where(status: "active")).to be_empty
    expect(batch.reload.history_profile_set_id).to be_present
  end

  it "does not replace the last valid result on failure" do
    publish(stopped_events)
    first = described_class.call(tenant: tenant, as_of: day)
    publish(stopped_events + [ { ago: 2 } ])
    allow(Amelia3::SalesAlertRules).to receive(:call).and_raise("Synthetic failure")
    expect { described_class.call(tenant: tenant, as_of: day) }.to raise_error("Synthetic failure")
    expect(tenant.reload.active_alert_run_id).to eq(first.run.id)
    expect(Amelia3::AlertRun.where(tenant: tenant, status: "failed").count).to eq(1)
  end

  it "resolves blocked habitual products without rescanning history or hiding customer activity" do
    events = [ 100, 90, 80, 70, 60 ].map { |ago| { ago: ago } } + [ { ago: 2, product: "K001" } ]
    publish(events)
    first = described_class.call(tenant: tenant, as_of: day)
    expect(first.run.items.where(status: "active").pluck(:rule_type)).to eq([ "USUAL_PRODUCT_MISSING" ])
    publish(events, blocked_product: true)
    updated = described_class.call(tenant: tenant, as_of: day)
    expect(updated.metrics["sourceRowsScanned"]).to eq(0)
    expect(updated.run.items.where(status: "active")).to be_empty
    expect(updated.run.items.where(status: "resolved").count).to eq(1)
    expect(described_class.call(tenant: tenant, as_of: day, full: true).metrics["identical"]).to be(true)
    updated.run.items.where(status: "resolved").delete_all
    expect { described_class.call(tenant: tenant, as_of: day, full: true) }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("ALERT_RESOLUTION_MISMATCH") }
  end

  it "bounds import waits and recovers a lost queued job without duplicating the logical run" do
    batch = publish(stopped_events)
    now = Time.find_zone!("Europe/Rome").local(2026, 10, 12, 6, 30)
    10.times { |n| Amelia3::AlertSchedule.tick(tenant, now + n * 15.minutes) }
    occurrence = Amelia3::AlertOccurrence.find_by!(tenant: tenant)
    expect(occurrence.attempts).to eq(8)
    expect(occurrence.job_id).to be_nil
    Amelia3::SyncOccurrence.create!(tenant: tenant, local_date: day, scheduled_at: now, status: "success", batch_id: batch.id)
    occurrence.update!(status: "queued", attempts: 0, updated_at: now - 31.minutes)
    Sidekiq::Testing.fake! do
      expect(Amelia3::AlertSchedule.tick(tenant, now).status).to eq("queued")
      expect(Amelia3::SalesAlertsJob.jobs.length).to eq(1)
      2.times { Amelia3::SalesAlertsJob.new.perform(occurrence.id) }
      expect(Amelia3::AlertRun.where(tenant: tenant, status: "published").count).to eq(1)
      Amelia3::SalesAlertsJob.clear
    end
  end

  it "paginates a stable filtered 4/4/2 mix without missing or duplicate alerts" do
    publish(stopped_events)
    run = described_class.call(tenant: tenant, as_of: day).run
    run.items.delete_all
    Amelia3::SalesAlertRules::TYPES.zip([ 9, 17, 5 ]).each do |type, count|
      count.times do |i|
        run.items.create!(customer_code: "C001", product_code: "TEST-#{i}", rule_type: type, severity_numerator: i + 1, severity_denominator: 1, days_late: i)
      end
    end
    scope = Amelia3::Scope.new(fixture[:agent])
    first = Amelia3::AlertPage.new(scope, {})
    expect(first.items.group_by(&:rule_type).transform_values(&:length).values).to eq([ 4, 4, 2 ])
    ids = (1..4).flat_map { |page| Amelia3::AlertPage.new(scope, { page: page }).items.map(&:id) }
    expect(ids.length).to eq(31)
    expect(ids.uniq.length).to eq(31)
    filtered = Amelia3::AlertPage.new(scope, { type: "USUAL_PRODUCT_MISSING", page: 2 })
    expect(filtered.items.length).to eq(7)
    expect(filtered.total).to eq(17)
  end

  it "waits for a same-day successful import, runs once and handles both DST transitions" do
    batch = publish(stopped_events)
    zone = Time.find_zone!("Europe/Rome")
    now = zone.local(2026, 10, 12, 6, 30)
    expect(Amelia3::AlertSchedule.tick(tenant, now - 1)).to be_nil
    wait = Amelia3::AlertSchedule.tick(tenant, now)
    expect(wait.status).to eq("waiting_import")
    imported = Amelia3::SyncOccurrence.create!(tenant: tenant, local_date: day, scheduled_at: now - 25.minutes, status: "success", batch_id: batch.id)
    Sidekiq::Testing.fake! do
      2.times { Amelia3::AlertSchedule.tick(tenant, now + 15.minutes) }
      expect(Amelia3::SalesAlertsJob.jobs.length).to eq(1)
      Amelia3::SalesAlertsJob.new.perform(wait.id)
      expect(wait.reload.status).to eq("success")
      expect(tenant.reload.active_alert_run.source).to eq("scheduled")
      fresh = publish(stopped_events + [ { ago: 2 } ])
      imported.update!(batch_id: fresh.id)
      expect(Amelia3::AlertSchedule.tick(tenant, now + 30.minutes).status).to eq("queued")
      Amelia3::SalesAlertsJob.clear
    end
    expect([ [ 3, 28 ], [ 3, 29 ], [ 10, 24 ], [ 10, 25 ] ].map { |month, day_number| Amelia3::AlertSchedule.scheduled_at(Date.new(2026, month, day_number)).utc.strftime("%H:%M") }).to eq(%w[05:30 04:30 04:30 05:30])
  end

  it "normalizes separate national/international contacts without joining digits or messages" do
    expect(Amelia3::ContactNumbers.call("Tel: 071 1234567; 3331234567 / +39 333 1234567 | 0044 2012345678")).to eq(%w[390711234567 393331234567 442012345678])
    expect(Amelia3::ContactNumbers.call("3331234567 3341234567")).to eq(%w[393331234567 393341234567])
    expect(Amelia3::ContactNumbers.call("0711 234567       -333 1234567 ufficio")).to eq(%w[390711234567 393331234567])
    expect(Amelia3::ContactNumbers.call("ufficio 0711234567 - mobile 3331234567")).to eq(%w[390711234567 393331234567])
    expect(Amelia3::ContactNumbers.call("not supplied; 12; 33312345673341234567; +++123456789")).to be_empty
  end
end
