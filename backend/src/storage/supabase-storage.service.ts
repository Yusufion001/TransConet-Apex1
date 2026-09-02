import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

class SupabaseStorageService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor() {
    this.client = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    this.bucket = env.SUPABASE_DOCUMENTS_BUCKET;
  }

  async createSignedUploadUrl(path: string) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(path);

    if (error) {
      throw new Error(`Failed to create signed upload URL: ${error.message}`);
    }

    return data;
  }

  async createSignedDownloadUrl(path: string, expiresIn = 3600) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed download URL: ${error.message}`);
    }

    return data;
  }

  async remove(path: string) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      throw new Error(`Failed to remove storage file: ${error.message}`);
    }
  }
}

export const supabaseStorageService = new SupabaseStorageService();
