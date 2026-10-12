pin "application", preload: true
pin "ralix", to: "ralix/index.js", preload: true
pin "dompurify", to: "dompurify.js", preload: true
%w[app helpers router events templates].each do |name|
  pin "ralix/src/#{name}", to: "ralix/#{name}.js", preload: true
end
pin_all_from "app/javascript/hfs", under: "hfs"
pin_all_from "app/javascript/controllers", under: "controllers"
pin_all_from "app/javascript/components", under: "components"
