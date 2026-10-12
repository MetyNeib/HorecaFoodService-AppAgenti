require "json"
require "digest"

module Hfs
  class Seed
    DATASET_ID = "HFS-AGENT-DEMO-20260922-V1".freeze
    SHA256 = "2fa3e0a68029226d01a0f1911fd4aedd616aca9768038a24f5c9c3004f01c4b6".freeze

    def self.data
      path = File.expand_path("../../..", __dir__) + "/src/data/hfs_demo_data.json"
      bytes = File.binread(path)
      raise ValidationError, "Il seed approvato è stato modificato." unless Digest::SHA256.hexdigest(bytes) == SHA256

      result = JSON.parse(bytes)
      result.fetch("branding").delete("visualSystem")
      result
    end

    def self.initial_state
      source = data
      { "schemaVersion" => 2, "datasetId" => DATASET_ID, "data" => source,
        "network" => "OFFLINE", "lastSyncAt" => source.fetch("demoDefaults").fetch("lastSyncAt"),
        "revision" => 0, "warning" => "" }
    end
  end
end
