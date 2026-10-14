# Run with Rails runner. Output contains only counts and digests, never row values.
require "digest"
connection = ApplicationRecord.connection
tables = (connection.tables + %w[schema_migrations ar_internal_metadata]).uniq.sort
fingerprints = tables.to_h do |table|
  quoted = connection.quote_table_name(table)
  keys = Array(connection.primary_key(table))
  order = keys.empty? ? "row_to_json(t)::text" : keys.map { |key| connection.quote_column_name(key) }.join(", ")
  digest = Digest::SHA256.new
  connection.raw_connection.copy_data("COPY (SELECT row_to_json(t)::text FROM #{quoted} t ORDER BY #{order}) TO STDOUT") do
    while (chunk = connection.raw_connection.get_copy_data)
      digest.update(chunk)
    end
  end
  [ table, { "rows" => connection.select_value("SELECT count(*) FROM #{quoted}"), "sha256" => digest.hexdigest } ]
end
if ENV["HFS_EXPECT_FINGERPRINT"].present?
  expected = JSON.parse(File.read(ENV.fetch("HFS_EXPECT_FINGERPRINT")))
  abort "Database fingerprint mismatch; restore not certified" unless expected == fingerprints
  puts JSON.generate(status: "PASS", tables: fingerprints.length, restored_rows_identical: true)
else
  File.write(ENV.fetch("HFS_FINGERPRINT_FILE"), JSON.pretty_generate(fingerprints) + "\n")
  puts JSON.generate(status: "PASS", tables: fingerprints.length, total_rows: fingerprints.values.sum { |row| row["rows"] })
end
