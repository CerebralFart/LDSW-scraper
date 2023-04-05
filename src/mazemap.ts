import {createWriteStream, existsSync, unlink} from "fs";
import {lineByLine} from "./util/fs";

const SCHEMA = './schemas/mazemap.xml';
const OUTPUT = './ontologies/mazemap.xml';
const CLOSE = '</rdf:RDF>';

(async () => {
    // Remove file if exists
    if (existsSync(OUTPUT)) unlink(OUTPUT, console.warn);

    // Copy initial data
    const output = createWriteStream(OUTPUT, {flags: 'a'})
    await lineByLine(SCHEMA, line => {
        if (line !== CLOSE) output.write(line + '\n')
    })

    const campusRequest = await fetch('https://api.mazemap.com/api/buildings/?campusid=171')
    const {buildings} = await campusRequest.json();
    for (const building of buildings) {
        const extraRequest = await fetch(`https://api.mazemap.com/api/buildings/${building.id}/poi/`)
        const extra = await extraRequest.json();

        await new Promise(res => output.write(
            `<owl:NamedIndividual rdf:about="http://ld.sven.mol.it/mazemap#Building-${building.id}">\n` +
            `<rdf:type rdf:resource="http://ld.sven.mol.it/mazemap#Building"/>\n` +
            `<id>${building.id}</id>\n` +
            `<name>${extra.buildingName}</name>\n` +
            `<locatedAt rdf:resource="http://ld.sven.mol.it/mazemap#University_of_Twente"/>\n` +
            `<geometry>${JSON.stringify(extra.geometry)}</geometry>\n` +
            `<floors>${building.floors.filter((floor: any) => floor.z > 0).length}</floors>\n` +
            `<center>${extra.point.coordinates[0]}, ${extra.point.coordinates[1]}</center>\n` +
            `</owl:NamedIndividual>\n`,
            res));
    }

    await new Promise(res => output.write(CLOSE, res));
    await output.end();
})();