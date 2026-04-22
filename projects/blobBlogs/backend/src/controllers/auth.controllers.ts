import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { signupSchema, loginSchema } from "../schemas/user.schema";

export const signup = async (req: Request, res: Response) => {};

export const login = async (req: Request, res: Response) => {};

export const logout = async (req: Request, res: Response) => {};
