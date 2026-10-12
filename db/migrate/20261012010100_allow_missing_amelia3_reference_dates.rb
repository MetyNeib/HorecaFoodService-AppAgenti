class AllowMissingAmelia3ReferenceDates < ActiveRecord::Migration[8.1]
  def change
    change_column_null :amelia3_open_items, :reference_date, true
  end
end
