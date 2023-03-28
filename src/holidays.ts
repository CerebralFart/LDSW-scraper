import {createWriteStream, existsSync, readFileSync, unlink} from 'fs'
import {lineByLine} from "./util/fs";
import {rdf} from "./util/datatypes";

const SCHEMA = './schemas/holidays.xml';
const INPUT = './data/holidays.json';
const OUTPUT = './ontologies/holidays.xml';
const CLOSE = '</rdf:RDF>';

(async () => {
    // Remove file if exists
    if (existsSync(OUTPUT)) unlink(OUTPUT, console.warn);

    // Copy initial data
    const output = createWriteStream(OUTPUT, {flags: 'a'})
    await lineByLine(SCHEMA, line => {
        if (line !== CLOSE) output.write(line + '\n')
    })

    const data = JSON.parse(readFileSync(INPUT).toString());

    const regionMap: { [key: string]: string[] } = {
        'heel Nederland': ['North', 'Center', 'South'],
        'noord': ['North'],
        'midden': ['Center'],
        'zuid': ['South']
    }

    for (const year of data) {
        let {schoolyear, vacations} = year.content[0];
        schoolyear = schoolyear.replace(/ /g, '');

        await new Promise(res => output.write(
            `<owl:NamedIndividual rdf:about="http://ld.sven.mol.it/ut-ldsw/holidays#${schoolyear}">\n` +
            `<rdf:type rdf:resource="http://ld.sven.mol.it/ut-ldsw/holidays#AcademicYear"/>\n` +
            `</owl:NamedIndividual>`,
            res));

        for (const holiday of vacations) {
            let {compulsorydates, type} = holiday;

            for (const data of holiday.regions) {
                let {region, startdate, enddate} = data;
                const suffix = region === 'heel Nederland' ? '' : `-${region}`

                await new Promise(res => output.write(
                    `<owl:NamedIndividual rdf:about="http://ld.sven.mol.it/ut-ldsw/holidays#${type}-${schoolyear}${suffix}">\n` +
                    `<rdf:type rdf:resource="http://ld.sven.mol.it/ut-ldsw/holidays#Holiday"/>\n` +
                    `<fallsInAcademicYear rdf:resource="http://ld.sven.mol.it/ut-ldsw/holidays#${schoolyear}"/>\n` +
                    regionMap[region].map(region => `<forRegion rdf:resource="http://ld.sven.mol.it/ut-ldsw/holidays#${region}"/>\n`).join('') +
                    `<startDate ${rdf.dateTime}>${(new Date(startdate)).toISOString()}</startDate>\n` +
                    `<endDate ${rdf.dateTime}>${(new Date(enddate)).toISOString()}</endDate>\n` +
                    `<isCompulsory ${rdf.boolean}>${compulsorydates}</isCompulsory>\n` +
                    `</owl:NamedIndividual>\n`,
                    res));
            }
        }
    }

    await new Promise(res => output.write(CLOSE, res));
    output.close();
})();