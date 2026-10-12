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
      data.each { |key, value| concat hidden_field_tag("payload[#{key}]", value) }
      concat capture(&block)
    end
  end

  def amelia_pagination(total, per_page: 50)
    render "amelia3/components/pagination", total: total, per_page: per_page
  end
end
