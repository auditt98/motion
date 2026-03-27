#!/usr/bin/env node
import { startHttpServer } from "./http.js";

const port = parseInt(process.env.PORT || "3001", 10);
startHttpServer(port);
