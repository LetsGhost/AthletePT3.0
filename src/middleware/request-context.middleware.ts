import { randomUUID } from "crypto";
import { NextFunction } from "express";

import { requestContext } from "../modules/common/logger/request-context";


export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  requestContext.run({ requestId: randomUUID() }, next);
}
