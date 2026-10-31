import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { AppTitleStrategy } from './shared/services/title-strategy';
import { provideMockData } from './core/mock/mock-data.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Cenário de exemplo em memória enquanto o Supabase não entra (ticket 18).
    provideMockData(),
    {
      provide: TitleStrategy,
      useClass: AppTitleStrategy,
    },
  ],
};
