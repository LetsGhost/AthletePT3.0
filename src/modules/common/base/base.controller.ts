import { Router } from "express";

export abstract class BaseController {
  public readonly router = Router();

  protected abstract routes(): void;

  constructor() {
    this.routes();
  }
}
