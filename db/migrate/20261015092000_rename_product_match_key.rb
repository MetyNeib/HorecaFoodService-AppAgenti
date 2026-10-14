class RenameProductMatchKey < ActiveRecord::Migration[8.1]
  def change
    rename_column :amelia3_product_matches, :cache_key, :match_key
  end
end
