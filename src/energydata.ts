import {createWriteStream, existsSync, unlink} from "fs";
import {lineByLine} from "./util/fs";
import {xsdFloat} from "./util/xsd";

const SCHEMA = './schemas/energydata.xml';
const OUTPUT = './ontologies/energydata.xml';
const CLOSE = '</rdf:RDF>';

(async () => {
    // Remove file if exists
    if (existsSync(OUTPUT)) unlink(OUTPUT, console.warn);

    // Copy initial data
    const output = createWriteStream(OUTPUT, {flags: 'a'})
    await lineByLine(SCHEMA, line => {
        if (line !== CLOSE) output.write(line + '\n')
    })

    const buildings: { [key: string]: string } = {
        bastille: 'http://ld.sven.mol.it/buildings#Bastille',
        carre: 'http://ld.sven.mol.it/buildings#Carré',
        citadel: 'http://ld.sven.mol.it/buildings#Citadel',
        cubicus: 'http://ld.sven.mol.it/buildings#Cubicus',
        horst: 'http://ld.sven.mol.it/buildings#Horst_Complex',
        nanolab: 'http://ld.sven.mol.it/buildings#Nanolab',
        paviljoen: 'http://ld.sven.mol.it/buildings#Paviljoen',
        ravelijn: 'http://ld.sven.mol.it/buildings#Ravelijn',
        spiegel: 'http://ld.sven.mol.it/buildings#Spiegel',
        sportcentrum: 'http://ld.sven.mol.it/buildings#Sportcentrum',
        technohal: 'http://ld.sven.mol.it/buildings#Technohal',
        vrijhof: 'http://ld.sven.mol.it/buildings#Vrijhof',
        waaier: 'http://ld.sven.mol.it/buildings#Waaier',
        zilverling: 'http://ld.sven.mol.it/buildings#Zilverling',
    };

    const types: { [key: string]: string } = {
        cold: 'http://www.ontology-of-units-of-measure.org/resource/om-2/kilowattHour',
        electricity: 'http://www.ontology-of-units-of-measure.org/resource/om-2/kilowattHour',
        gas: 'http://www.ontology-of-units-of-measure.org/resource/om-2/cubicMetre',
        heat: 'http://www.ontology-of-units-of-measure.org/resource/om-2/gigajoule',
        water: 'http://www.ontology-of-units-of-measure.org/resource/om-2/cubicMetre'
    }

    const holidays: [Date, Date][] = [];
    try {
        const holidayReq = await fetch(`https://ld.sven.mol.it/holidays/sparql`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                contentType: 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                query: `\
                PREFIX time: <http://www.w3.org/2006/time#>
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                PREFIX holidays: <http://ld.sven.mol.it/holidays#>

                SELECT ?start ?end
                WHERE {
                    ?holiday rdf:type holidays:Holiday; holidays:forRegion holidays:North; holidays:isCompulsory "true"^^xsd:boolean; time:hasBeginning/time:inXSDDateTimeStamp ?start; time:hasEnd/time:inXSDDateTimeStamp ?end;
                }`
            })
        })
        const data: {
            results: { bindings: ({ start: { value: string }, end: { value: string } })[] }
        } = await holidayReq.json();
        data.results.bindings.forEach(({start, end}) => {
            holidays.push([new Date(start.value), new Date(end.value)]);
        })
    } catch (e) {
        console.log(e)
    }

    for (const building in buildings) {
        const buildingIRI = buildings[building];

        const pivot: { [key: string]: { [key: string]: number } } = {};
        const statistics: { [key: string]: [number, number] } = {};

        for (const type in types) {
            console.log(building, type)
            const dataRequest = await fetch(`https://energyapi.utwente.nl/api/energy/${building}/${type}?from=2021-01-01T00:00:00Z&to=2024-01-01T00:00:00Z&resolution=hour&corrected=false`)
            const {error, results}: {
                error: string | undefined,
                results: { data: ({ timestamp: string, value: number })[] }
            } = await dataRequest.json();
            if (error) continue;

            for (const entry of results.data) {
                pivot[entry.timestamp] = {
                    ...pivot[entry.timestamp],
                    [type]: entry.value,
                }
            }

            const relevant = results.data
                .filter(entry => {
                    const date = new Date(entry.timestamp);
                    if (date.getDay() === 0 || date.getDay() === 6) return false;
                    return holidays.find(([start, end]) => start < date && date < end) === undefined;
                }).map(entry => entry.value)

            const average = relevant.reduce((a, b) => a + b, 0) / relevant.length;
            const stdDev = Math.sqrt(relevant.map(v => (v - average) ** 2).reduce((a, b) => a + b, 0) / (relevant.length - 1));
            statistics[type] = [average, stdDev];
        }

        await new Promise(res => output.write([
            '<Statistics>',
            `<building rdf:resource="${buildingIRI}"/>`,
            'cold' in statistics ? `<cold><_><average rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.cold[0]}</average><stdDev rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.cold[1]}</stdDev><unit rdf:resource="${types.cold}"/></_></cold>` : '',
            'electricity' in statistics ? `<electricity><_><average rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.electricity[0]}</average><stdDev rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.electricity[1]}</stdDev><unit rdf:resource="${types.electricity}"/></_></electricity>` : '',
            'gas' in statistics ? `<gas><_><average rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.gas[0]}</average><stdDev rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.gas[1]}</stdDev><unit rdf:resource="${types.gas}"/></_></gas>` : '',
            'heat' in statistics ? `<heat><_><average rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.heat[0]}</average><stdDev rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.heat[1]}</stdDev><unit rdf:resource="${types.heat}"/></_></heat>` : '',
            'water' in statistics ? `<water><_><average rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.water[0]}</average><stdDev rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${statistics.water[1]}</stdDev><unit rdf:resource="${types.water}"/></_></water>` : '',
            '</Statistics>'
        ].filter(Boolean).join('\n'), res));

        for (const timestamp in pivot) {
            const data = pivot[timestamp];
            const start = new Date(timestamp);
            const end = new Date(timestamp);
            end.setHours(end.getHours() + 1);

            await new Promise(res => output.write('<Measurement>\n', res));
            await new Promise(res => output.write([
                '<rdf:type rdf:resource="http://ld.sven.mol.it/energydata#Measurement"/>',
                `<building rdf:resource="${buildingIRI}"/>`,
                `<time:hasBeginning><time:Instant time:inXSDDateTimeStamp="${start.toISOString()}"/></time:hasBeginning>`,
                `<time:hasEnd><time:Instant time:inXSDDateTimeStamp="${end.toISOString()}"/></time:hasEnd>`,
                'cold' in data ? `<cold><_><value rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${data.cold}</value><unit rdf:resource="${types.cold}"/></_></cold>` : undefined,
                'electricity' in data ? `<electricity><_><value rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${data.electricity}</value><unit rdf:resource="${types.electricity}"/></_></electricity>` : undefined,
                'gas' in data ? `<gas><_><value rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${data.gas}</value><unit rdf:resource="${types.gas}"/></_></gas>` : undefined,
                'heat' in data ? `<heat><_><value rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${data.heat}</value><unit rdf:resource="${types.heat}"/></_></heat>` : undefined,
                'water' in data ? `<water><_><value rdf:datatype="http://www.w3.org/2001/XMLSchema#float">${data.water}</value><unit rdf:resource="${types.water}"/></_></water>` : undefined,
            ].filter(Boolean).join('\n'), res))
            await new Promise(res => output.write('\n</Measurement>\n', res));
        }
    }

    await new Promise(res => output.write(CLOSE, res));
    await output.end();
})();
