export function key<K, V>(keys: readonly string[], values: V[]): { [K in typeof keys[number]]: V } {
    const ret: { [K in typeof keys[number]]: V } = {};
    for (let i = 0; i < keys.length; i++) {
        if (keys[i]) ret[keys[i]] = values[i];
    }
    return ret;
}