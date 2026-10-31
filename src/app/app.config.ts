import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { AppTitleStrategy } from './shared/services/title-strategy';
import { provideData } from './core/data.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Banco ou cenário de exemplo: quem decide é src/environments.
    provideData(),
    {
      provide: TitleStrategy,
      useClass: AppTitleStrategy,
    },
  ],
};
