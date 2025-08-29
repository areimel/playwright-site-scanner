import chalk from 'chalk';
import { getBrandingConfig } from './config-loader.js';

export const getWelcomeScreen = async (): Promise<string> => {
  const branding = await getBrandingConfig();
  return chalk.hex(branding.welcomeScreen.color)(branding.welcomeScreen.ascii);
};

export const getBanner = async (): Promise<string> => {
  const branding = await getBrandingConfig();
  return chalk.hex(branding.banner.color)(`
  ${branding.banner.title}
  ${branding.banner.subtitle}
  
  ${branding.banner.builtBy}
  ${branding.banner.moreTools}
`);
};