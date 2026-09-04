import { youverifyClient } from "../youverify.client.js";

export type YouverifyVerificationType =
  | "nin"
  | "vnin"
  | "bvn"
  | "drivers_license"
  | "passport";

export interface YouverifyVerificationInput {
  type: YouverifyVerificationType;
  id: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  subjectConsent: boolean;
  selfieImage?: string;
}

export interface YouverifyResponse {
  success?: boolean;
  statusCode?: number;
  message?: string;
  data?: {
    id?: string;
    status?: string;
    reference_id?: string;
    referenceId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const endpointMap: Record<
  YouverifyVerificationType,
  string
> = {
  nin: "/v2/api/identity/ng/nin",
  vnin: "/v2/api/identity/ng/vnin",
  bvn: "/v2/api/identity/ng/bvn",
  drivers_license: "/v2/api/identity/ng/drivers-license",
  passport: "/v2/api/identity/ng/passport",
};

function buildBody(
  input: YouverifyVerificationInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: input.id,
    isSubjectConsent: input.subjectConsent,
  };

  if (
    input.firstName ||
    input.lastName ||
    input.dateOfBirth
  ) {
    body.validations = {
      data: {
        ...(input.firstName
          ? { firstName: input.firstName }
          : {}),
        ...(input.lastName
          ? { lastName: input.lastName }
          : {}),
        ...(input.dateOfBirth
          ? { dateOfBirth: input.dateOfBirth }
          : {}),
      },
    };
  }

  if (input.selfieImage) {
    const validations = (body.validations ?? {}) as Record<string, unknown>;
    validations.selfie = {
      image: input.selfieImage,
    };
    body.validations = validations;
  }

  return body;
}

export async function verifyIdentity(
  input: YouverifyVerificationInput,
): Promise<YouverifyResponse> {
  if (!input.subjectConsent) {
    throw new Error(
      "Subject consent is required for Youverify verification",
    );
  }

  const endpoint = endpointMap[input.type];

  if (!endpoint) {
    throw new Error(
      `Unsupported Youverify verification type: ${input.type}`,
    );
  }

  return youverifyClient.post<YouverifyResponse>(
    endpoint,
    buildBody(input),
  );
}

export function extractYouverifyVerificationId(
  response: YouverifyResponse,
): string | undefined {
  const data = response.data;

  if (!data) {
    return undefined;
  }

  const id =
    data.id ??
    data.referenceId ??
    data.reference_id;

  return typeof id === "string" && id.length > 0
    ? id
    : undefined;
}
