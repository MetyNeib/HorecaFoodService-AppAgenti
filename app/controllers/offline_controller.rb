class OfflineController < ActionController::Base
  def show
    response.headers["Cache-Control"] = "no-cache"
    render layout: false
  end

  def manifest
    render json: {
      id: "/", name: "Horeca Food Service — App Agenti", short_name: "HFS Agenti",
      lang: "it", start_url: "/", scope: "/", display: "standalone",
      background_color: "#f7f4ef", theme_color: "#2e60ff",
      icons: [
        { src: "/icons/hfs-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/hfs-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ]
    }
  end
end
