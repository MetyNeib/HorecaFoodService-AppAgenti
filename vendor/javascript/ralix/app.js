import Helpers   from 'ralix/src/helpers'
import Router    from 'ralix/src/router'
import Events    from 'ralix/src/events'
import Templates from 'ralix/src/templates'

export default class App {
  constructor(config = {}) {
    this.helpers    = new Helpers()
    this.router     = new Router(config.routes)
    this.events     = new Events()
    this.templates  = new Templates(config.templates)
    this.rails_ujs  = config.rails_ujs || null
    this.components = config.components || []

    window.App = this
  }

  get ctrl() {
    return this.router.ctrl
  }

  start() {
    let loadEvent = 'DOMContentLoaded'
    if (typeof Turbo !== 'undefined') loadEvent = 'turbo:load'
    if (typeof Turbolinks !== 'undefined') loadEvent = 'turbolinks:load'

    document.addEventListener(loadEvent, () => {
      this.helpers.inject()
      this.router.dispatch()
      this.events.bind()
      this.components.forEach(component => {
        if (typeof component.onload === 'function')
          component.onload()
      })
    })
  }
}
