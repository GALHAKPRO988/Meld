const encode = (bytes: ArrayLike<number>) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4}$/.test(pin)) throw new Error("El PIN debe tener 4 dígitos.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return encode(new Uint8Array(digest));
}

export async function verifyPin(pin: string, expectedHash: string): Promise<boolean> {
  const candidate = await hashPin(pin);
  const a = decode(candidate);
  const b = decode(expectedHash);
  if (a.length !== b.length) return false;
  return a.every((byte, index) => byte === b[index]);
}

export async function hasPlatformAuthenticator(): Promise<boolean> {
  return Boolean(
    typeof window !== "undefined" &&
    window.PublicKeyCredential &&
    (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()),
  );
}

export async function registerBiometric(deviceId: string): Promise<string> {
  if (!(await hasPlatformAuthenticator()))
    throw new Error("Este dispositivo no ofrece un autenticador biométrico compatible.");
  const userId = new TextEncoder().encode(deviceId);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Meld", id: window.location.hostname },
      user: { id: userId, name: "Meld local", displayName: "Meld" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60_000,
      attestation: "none",
    },
  });
  if (!(credential instanceof PublicKeyCredential))
    throw new Error("No se pudo registrar la biometría.");
  return encode(new Uint8Array(credential.rawId));
}

export async function authenticateBiometric(credentialId: string): Promise<boolean> {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: decode(credentialId) }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return (
    credential instanceof PublicKeyCredential &&
    encode(new Uint8Array(credential.rawId)) === credentialId
  );
}
