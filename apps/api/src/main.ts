import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Duplex } from "stream";
import express from "express";
import { IncomingMessage } from "http";
import { WebSocketServer } from "ws";
import { AppModule } from "./app.module";
import { ZodExceptionFilter } from "./common/zod-exception.filter";
import { TelephonyService } from "./telephony/telephony.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  app.use(express.text({ type: ["application/sdp", "text/plain"] }));
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ZodExceptionFilter());

  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";
  const server = await app.listen(port, host);
  const telephonyService = app.get(TelephonyService);
  const mediaSocketServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const host = request.headers.host || `localhost:${port}`;
    const url = new URL(request.url || "/", `http://${host}`);

    if (url.pathname !== "/ws/twilio-media") {
      socket.destroy();
      return;
    }

    mediaSocketServer.handleUpgrade(request, socket, head, (client) => {
      void telephonyService.handleTwilioMediaStream(client, url);
    });
  });

  Logger.log(`API ready on ${host}:${port}/api`, "Bootstrap");
  Logger.log(`Twilio media bridge ready on ${host}:${port}/ws/twilio-media`, "Bootstrap");
}

void bootstrap();
