import {enableProdMode} from '@angular/core';
import * as jQuery from "jquery";
import {environment} from './environments/environment';
import {platformBrowser} from "@angular/platform-browser";
import {AppModule} from "core-app/app.module";

(window as any).global = window;


require('./app/init-vendors');
require('./app/init-globals');
// require('./app/bootstrap');


if (environment.production) {
  enableProdMode();
}

jQuery(function () {
// Due to the behaviour of the Edge browser we need to wait for 'DOM ready'
  platformBrowser()
    .bootstrapModule(AppModule)
    .then(platformRef => {
      jQuery('body').addClass('__ng2-bootstrap-has-run');
    });
});

