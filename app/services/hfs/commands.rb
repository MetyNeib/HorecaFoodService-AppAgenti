require "digest"
require "json"

module Hfs
  class Commands
    MAX_COMMAND_BYTES = 65_536

    def self.call(user:, command:)
      new(user, command).call
    end

    def initialize(user, command)
      @user = user
      @command = command
    end

    def call
      validate_envelope!
      workspace = Snapshot.workspace_for(@user)
      result = nil
      workspace.with_lock do
        snapshot = -> { Snapshot.serialize(@user, workspace) }
        receipt = @user.command_receipts.find_by(operation_id: @command.fetch("operationId"))
        if receipt
          unless receipt.request_digest == digest
            raise Conflict.new("Chiave operazione già usata per una richiesta diversa.", snapshot: snapshot.call)
          end
          # A lost RESET response may be replayed, but no pre-reset operation can
          # resurrect data or return a stale account snapshot after another reset.
          unless receipt.epoch == workspace.epoch
            raise Conflict.new("La demo è stata ripristinata su un altro dispositivo.", snapshot: snapshot.call)
          end
          result = receipt.response.transform_keys(&:to_sym)
          next
        end
        unless @command.fetch("epoch") == workspace.epoch
          raise Conflict.new("La demo è stata ripristinata. Conserva le modifiche locali e ricarica i dati.", snapshot: snapshot.call)
        end
        unless @command.fetch("baseVersion") == workspace.version
          raise Conflict.new("I dati sono cambiati su un altro dispositivo. Le modifiche locali sono conservate.", snapshot: snapshot.call)
        end
        type = @command.fetch("type")
        state = Domain.new(workspace.state, agent_id: @user.agent_id).apply(type, @command.fetch("payload"))
        version = workspace.version + 1
        state["revision"] = version
        workspace.update!(state: state, version: version, epoch: type == "RESET_DEMO" ? workspace.epoch + 1 : workspace.epoch)
        result = Snapshot.serialize(@user, workspace)
        CommandReceipt.create!(user: @user, workspace: workspace, operation_id: @command.fetch("operationId"),
                               request_digest: digest, command_type: type, epoch: workspace.epoch,
                               result_version: version, response: result)
      end
      result
    end

    private

    def validate_envelope!
      unless @command.is_a?(Hash) && (@command.keys - %w[operationId baseVersion epoch type payload]).empty?
        raise ValidationError, "Formato comando non valido."
      end
      id = @command["operationId"]
      unless id.is_a?(String) && id.match?(/\A[A-Za-z0-9][A-Za-z0-9_-]{0,127}\z/)
        raise ValidationError, "Identificativo operazione non valido."
      end
      unless @command["baseVersion"].is_a?(Integer) && @command["baseVersion"] >= 0 && @command["epoch"].is_a?(Integer) && @command["epoch"] >= 1
        raise ValidationError, "Versione o generazione non valida."
      end
      unless Domain::TYPES.include?(@command["type"]) && @command["payload"].is_a?(Hash)
        raise ValidationError, "Operazione o payload non valido."
      end
      raise ValidationError, "Comando troppo grande." if JSON.generate(@command).bytesize > MAX_COMMAND_BYTES
    end

    def canonical(value)
      case value
      when Hash then value.keys.sort.to_h { |key| [ key, canonical(value.fetch(key)) ] }
      when Array then value.map { |item| canonical(item) }
      else value
      end
    end

    def digest
      @digest ||= Digest::SHA256.hexdigest(JSON.generate(canonical(@command)))
    end
  end
end
