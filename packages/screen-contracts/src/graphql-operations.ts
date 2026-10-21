import { buildSchema } from "graphql";
export function graphqlOperations(sdl: string) {
  const schema = buildSchema(sdl);
  return [
    ...Object.keys(schema.getQueryType()?.getFields() ?? {}),
    ...Object.keys(schema.getMutationType()?.getFields() ?? {}),
  ].map((name) => "graphql:" + name);
}
