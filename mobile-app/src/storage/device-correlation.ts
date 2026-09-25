import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const DEVICE_CORRELATION_ID_KEY = "transconet_device_correlation_id";

export async function getDeviceCorrelationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_CORRELATION_ID_KEY);

  if (existing?.trim()) {
    return existing;
  }

  const generated = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_CORRELATION_ID_KEY, generated);

  return generated;
}
