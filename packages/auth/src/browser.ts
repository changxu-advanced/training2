import { Amplify } from "aws-amplify";

export { fetchAuthSession, signIn, signOut } from "aws-amplify/auth";
export function configureBrowserAuth(settings: {
  userPoolId: string;
  userPoolClientId: string;
  localEndpoint?: string;
}) {
  if (settings.localEndpoint) {
    const url = new URL(settings.localEndpoint);
    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      throw new Error("Local browser auth must target localhost.");
  }
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: settings.userPoolId,
        userPoolClientId: settings.userPoolClientId,
        ...(settings.localEndpoint
          ? { userPoolEndpoint: settings.localEndpoint }
          : {}),
      },
    },
  });
}
