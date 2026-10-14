module Amelia3Helper
  def amelia_decimal(value)
    value.nil? ? "—" : value.to_s("F").sub(/(\.\d*?)0+\z/, '\1').sub(/\.\z/, "").tr(".", ",")
  end

  def amelia_amount(value)
    value.nil? ? "—" : number_to_currency(value, unit: "€", format: "%n %u", separator: ",", delimiter: ".")
  end

  def amelia_status(order)
    order.status == "CONFIRMED_LOCAL" ? "Confermato · salvato localmente" : "Bozza"
  end

  def amelia_history_quantity(row, product)
    # Historic exports contain independent quantities, not a historic conversion contract.
    # Prefer the matching source channel; never convert using today's packing factors.
    channels = { "CONF" => row.packs, "PZ" => row.pieces, "KG" => row.weight }
    preferred = product&.canonical_units&.fetch("preferredUm")
    unit = channels.key?(preferred) ? preferred : Amelia3::CanonicalUnits::MAP[product&.base_unit]
    unit = channels.find { |_, quantity| quantity&.positive? }&.first || "CONF" unless channels.key?(unit)
    "#{amelia_decimal(channels.fetch(unit))} #{unit}"
  end

  def amelia_alert_explanation(alert)
    evidence = alert.evidence
    subject = alert.rule_type == "USUAL_PRODUCT_MISSING" ? "di questo prodotto" : "dal cliente"
    "Ti avvisiamo perché non risultano nuovi acquisti #{subject} da almeno #{evidence['thresholdDays']} giorni, il periodo di attesa previsto in base agli acquisti precedenti."
  end

  def amelia_form(type, payload, return_to:, classes: "", &block)
    data = payload.stringify_keys.merge("batchId" => @scope.batch_id)
    data["expectedVersion"] = @order.version if @order && type != "CREATE_DRAFT"
    form_with(url: "/amelia3/commands", method: :post, local: true,
              class: "amelia_command_form_js #{classes}", data: { command: type, payload: data.to_json, return_to: return_to }) do
      concat hidden_field_tag(:type, type)
      concat hidden_field_tag(:operationId, SecureRandom.uuid)
      concat hidden_field_tag(:baseVersion, @scope.tenant.revision)
      concat hidden_field_tag(:epoch, 1)
      concat hidden_field_tag(:owner_user_id, Amelia3::Snapshot.identity(current_user))
      concat hidden_field_tag(:return_to, return_to)
      data.each do |key, value|
        if value.is_a?(Hash)
          value.each { |part, item| concat hidden_field_tag("payload[#{key}][#{part}]", item) }
        else
          concat hidden_field_tag("payload[#{key}]", value)
        end
      end
      concat capture(&block)
    end
  end

  def amelia_pagination(total, per_page: 50)
    render "amelia3/components/pagination", total: total, per_page: per_page
  end
end
