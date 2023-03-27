export type Serializer<T> = (value: T) => string;
export const xsdBoolean: Serializer<boolean> = value => `"${value ? 'true' : 'false'}"^^xsd:boolean`
export const xsdDateTime: Serializer<Date> = value => `"${value.toISOString()}"^^xsd:dateTime`;
export const xsdFloat: Serializer<number> = value => `"${value}"^^xsd:float`;
export const xsdInteger: Serializer<number> = value => `"${value.toFixed(0)}"^^xsd:integer`;