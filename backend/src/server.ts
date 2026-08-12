import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "TransConet-Apex1 API",
    status: "healthy"
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`TransConet-Apex1 API running on port ${port}`);
});
