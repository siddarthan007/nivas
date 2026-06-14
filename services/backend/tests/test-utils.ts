import { Elysia } from "elysia";
import { HttpError } from "../src/utils/errors";

export const createTestApp = <T extends Elysia<any, any, any, any, any, any, any>>(controller: T) => {
    return new Elysia()
        .onError(({ error, set }) => {
            if (error instanceof HttpError) {
                set.status = error.statusCode;
                return { status: 'error', message: error.message, code: error.code };
            }
        })
        .use(controller);
};
