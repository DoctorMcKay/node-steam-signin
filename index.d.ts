// @ts-ignore
import SteamID from 'steamid';

declare class SteamSignIn {
  constructor(realm: string);
  getUrl(returnUrl: string): string;
  verifyLogin(url: string): Promise<SteamID>;
}

export default SteamSignIn;
