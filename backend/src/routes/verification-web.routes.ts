import { Router } from "express";

const router = Router();

const ANDROID_PACKAGE = "com.transconet.apex1";
const ANDROID_SHA256 =
  "75:97:94:6F:6B:DC:B8:2E:3B:4A:8B:AC:87:68:BF:86:86:76:99:93:BD:7A:7C:55:41:A8:29:E5:9D:AA:6F:E9";

router.get("/.well-known/assetlinks.json", (_req, res) => {
  return res
    .type("application/json")
    .json([
      {
        relation: [
          "delegate_permission/common.handle_all_urls",
        ],
        target: {
          namespace: "android_app",
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: [ANDROID_SHA256],
        },
      },
    ]);
});

router.get("/verify-email", (req, res) => {
  const token =
    typeof req.query.token === "string"
      ? req.query.token.trim()
      : "";

  if (!/^[a-fA-F0-9]{64}$/.test(token)) {
    return res.status(400).type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TransConet — Verification Link</title>
</head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:60px auto;padding:24px">
  <h1>Invalid verification link</h1>
  <p>This email verification link is invalid or incomplete.</p>
  <p>Please request a new verification email from the TransConet app.</p>
</body>
</html>`);
  }

  const encodedToken = encodeURIComponent(token);
  const appUrl = `transconet://verify-email?token=${encodedToken}`;

  res
    .type("html")
    .send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Verify your TransConet email</title>
</head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:60px auto;padding:24px;text-align:center">
  <h1>Verify your TransConet email</h1>
  <p>Opening the TransConet Android app…</p>
  <p>
    <a href="${appUrl}">Open TransConet</a>
  </p>
  <script>
    window.location.replace(${JSON.stringify(appUrl)});
  </script>
</body>
</html>`);
});

export default router;
