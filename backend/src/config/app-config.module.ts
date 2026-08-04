import { Global, Module } from '@nestjs/common';
import loadConfiguration from './configuration';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Global, typed config provider — reads and validates env vars once at boot. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useValue: loadConfiguration() }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
