import { randomUUID } from "crypto";
import { requestContext } from "../modules/common/logger/request-context";

export function requestContextMiddleware(req, _res, next) {
  requestContext.run({ requestId: randomUUID() }, next);
}
