import { mountFrontend } from "@training2/ui";
import { routeManifest } from "./route-manifest.ts";

void mountFrontend("private", routeManifest);
