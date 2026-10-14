require 'rails_helper'
require_relative '../support/amelia3_fixture'
require_relative '../support/amelia3_feed_fixture'

RSpec.describe Amelia3::IncomingFeed do
  include Amelia3Fixture
  include Amelia3FeedFixture
  let(:fixture) { commercial_fixture }
  let(:tenant) { fixture[:tenant] }
  let(:root) { Pathname(Dir.mktmpdir('hfs-feed-qa-')) }
  let(:ftp) { Amelia3FeedFixture::ReadOnlyFtp.new(feed_csvs.merge('/DOWNLOAD/BACKUP/initial.csv' => incoming_csv)) }
  let(:settings) { instance_double(Amelia3::FtpSettings, credentials: [ 'synthetic.invalid', 'synthetic', 'unused' ], port: 21) }
  after do
    FileUtils.remove_entry(fixture[:directory])
    FileUtils.remove_entry(root)
  end

  def pull
    described_class.new(tenant: tenant, ftp: ftp, settings: settings, root: root).call
  end

  it 'archives the initial listing, counts only later orders, and never duplicates repeated pulls' do
    expect(pull).to eq(true)
    expect(Amelia3::IncomingOrder.where(tenant: tenant).sole.status).to eq('archived')
    expect(Amelia3::HabitualProducts.codes(Amelia3::Scope.new(fixture[:agent]), 'C001')).to eq([ 'P001' ])
    expect(tenant.reload.feed_snapshot.counts).to include('habitualPairs' => 1, 'excludedPairs' => 2)
    expect(pull).to eq(true)
    expect(Amelia3::FeedSnapshot.where(tenant: tenant).count).to eq(1)
    ftp.files['/DOWNLOAD/BACKUP/new.csv'] = incoming_csv(reference: 'QA-2')
    pull
    expect(Amelia3::Scope.new(fixture[:agent]).notifications['unreadOrders']).to eq(1)
    incoming = Amelia3::IncomingOrder.where(tenant: tenant, status: 'pending').sole
    expect(incoming.confirmation_due_at - incoming.received_at).to eq(1800)
    ftp.files['/DOWNLOAD/BACKUP/renamed.csv'] = ftp.files['/DOWNLOAD/BACKUP/new.csv']
    pull
    expect(Amelia3::IncomingOrder.where(tenant: tenant).count).to eq(2)
  end

  it 'keeps incomplete initial files in the initial archive when they later become readable' do
    ftp.files['/DOWNLOAD/BACKUP/broken.csv'] = 'invalid'
    pull
    expect(Amelia3::FeedState.find_by!(tenant: tenant).file_errors.values).to include('INBOX_INVALID_HEADER')
    ftp.files['/DOWNLOAD/BACKUP/broken.csv'] = incoming_csv(reference: 'QA-recovered')
    pull
    expect(Amelia3::IncomingOrder.find_by!(external_reference: 'QA-recovered').status).to eq('archived')
    expect(Amelia3::FeedState.find_by!(tenant: tenant).file_errors).to be_empty
  end

  it 'retains the last published catalog and original order when replacement files are invalid' do
    pull
    snapshot_id = tenant.reload.feed_snapshot_id
    ftp.files['/DOWNLOAD/BACKUP/changed.csv'] = incoming_csv(quantity: '3')
    pull
    expect(Amelia3::IncomingOrder.where(tenant: tenant).count).to eq(1)
    expect(Amelia3::FeedState.find_by!(tenant: tenant).file_errors.values).to include('INBOX_SOURCE_CHANGED')
    ftp.files['/matia_ftp/catalogo.csv'] = 'invalid'
    expect { pull }.to raise_error(Amelia3::Error)
    expect(tenant.reload.feed_snapshot_id).to eq(snapshot_id)
    expect(Amelia3::FeedSnapshot.where(tenant: tenant).count).to eq(1)
  end

  it 'retries a download changed during transfer without publishing it or losing the initial archive' do
    ftp.unstable = true
    expect { pull }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq('FEED_UNSTABLE') }
    expect(Amelia3::IncomingOrder.where(tenant: tenant)).to be_empty
    expect(tenant.reload.feed_snapshot).to be_nil
    expect(root.glob('*.part')).to be_empty
    ftp.unstable = false
    expect(pull).to eq(true)
    expect(Amelia3::IncomingOrder.where(tenant: tenant).sole.status).to eq('archived')
    expect(tenant.reload.feed_snapshot).to be_present
  end

  it 'accepts both source layouts, preserves notes and rejects malformed quantities' do
    [ 11, 14 ].each do |length|
      parsed = Amelia3::IncomingOrderParser.call(incoming_csv(columns: length, unit: 'CT'))
      expect(parsed['lines'].sole).to include('quantity' => '2.5', 'unit' => 'COLL', 'sourceUnit' => 'CT', 'note' => 'Nota riga')
    end
    expect { Amelia3::IncomingOrderParser.call(incoming_csv(quantity: '-1')) }.to raise_error(Amelia3::Error)
    expect { Amelia3::IncomingOrderParser.call(incoming_csv(columns: 10)) }.to raise_error(Amelia3::Error)
    expect { Amelia3::IncomingOrderParser.call(incoming_csv(quantity: 'NaN')) }.to raise_error(Amelia3::Error)
  end
end
