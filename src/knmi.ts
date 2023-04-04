import {createWriteStream, existsSync, readFileSync, unlink, writeFileSync} from 'fs'
import {key} from "./util/array";
import {lineByLine} from "./util/fs";
import {xsdBoolean, xsdDateTime, xsdFloat} from "./util/xsd";
import {rdf} from "./util/datatypes";
import {om2} from "./util/resources";

const SCHEMA = './schemas/knmi.xml';
const INPUT = './data/knmi.csv';
const OUTPUT = './ontologies/knmi.xml';
const CLOSE = '</rdf:RDF>';
const LAYOUT = [
    'station',
    'date',
    'hour',
    'wind_direction',
    'wind_speed',
    'FF',// FF isn't mapped into the ontology as it isn't deemed relevant
    'wind_gusts',
    'temperature',
    'T10N',// T10N isn't mapped into the ontology as it isn't deemed relevant
    'TD',// TD isn't mapped into the ontology as it isn't deemed relevant
    'sun_time',
    'sun_total',
    'rain_time',
    'rain_total',
    'pressure',
    'visibility',
    'cloud_cover',
    'humidity',
    'WW',// WW isn't mapped into the ontology as it is often missing
    'measurement_type',
    'fog',
    'rain',
    'snow',
    'lightning',
    'icing'
] as const;

(async () => {
    // Remove file if exists
    if (existsSync(OUTPUT)) unlink(OUTPUT, console.warn);

    // Copy initial data
    const output = createWriteStream(OUTPUT, {flags: 'a'})
    await lineByLine(SCHEMA, line => {
        if (line !== CLOSE) output.write(line + '\n')
    })

    // Process data
    await lineByLine(INPUT, async line => {
        const data = key(LAYOUT, line.trim().split(/, */));
        const name = data.date.substring(0, 4) + '-' + data.date.substring(4, 6) + '-' + data.date.substring(6, 8) + '-' + (data.hour.length < 2 ? '0' + data.hour : data.hour);

        const periodStart = new Date(data.date.substring(0, 4) + '-' + data.date.substring(4, 6) + '-' + data.date.substring(6, 8));
        periodStart.setHours(parseInt(data.hour) - 1)
        const periodEnd = new Date(periodStart)
        periodEnd.setTime(periodStart.getTime() + 3600_000);

        const visibility = parseInt(data.visibility)

        await new Promise(res => output.write(
            `<owl:NamedIndividual rdf:about="http://ld.sven.mol.it/knmi#${name}">\n` +
            '<rdf:type rdf:resource="http://ld.sven.mol.it/knmi#Measurement"/>\n' +
            (['1', '2', '3'].indexOf(data.measurement_type) === -1 ? '' :
                '<rdf:type rdf:resource="http://ld.sven.mol.it/knmi#ManualMeasurement"/>\n') +
            (['4', '5', '6', '7'].indexOf(data.measurement_type) === -1 ? '' :
                '<rdf:type rdf:resource="http://ld.sven.mol.it/knmi#AutomaticMeasurement"/>\n') +
            (['2', '3', '5', '6'].indexOf(data.measurement_type) === -1 ? '' :
                '<rdf:type rdf:resource="http://ld.sven.mol.it/knmi#OmittedMeasurement"/>\n') +
            `<measuredAt rdf:resource="http://ld.sven.mol.it/knmi#Twenthe"/>\n` +
            `<time:hasBeginning><time:Instant time:inXSDDateTimeStamp="${new Date(periodStart).toISOString()}"/></time:hasBeginning>\n` +
            `<time:hasEnd><time:Instant time:inXSDDateTimeStamp="${new Date(periodEnd).toISOString()}"/></time:hasEnd>\n` +
            (data.cloud_cover === '' ? '' : valueNode(
                'cloudCover',
                data.cloud_cover === '9' ? 100 : parseInt(data.cloud_cover) / 8 * 100,
                om2.percent
            )) +
            valueNode('temperature', parseInt(data.temperature) / 10, om2.celsius) +
            valueNode('pressure', parseInt(data.pressure) / 10, om2.hectoPascal) +
            // 0 => 0m ... 50 => 5000m
            (visibility <= 50 ? valueNode(
                'visibility',
                visibility * 100,
                om2.meter
            ) : '') +
            // 56 => 6km ... 80 => 30km
            (visibility > 55 && visibility <= 80 ? valueNode(
                'visibility',
                visibility - 50,
                om2.kilometer
            ) : '') +
            // 81 => 35km ... 89 => 75km
            (visibility > 80 ? valueNode(
                'visibility',
                30 + (visibility - 80) * 5,
                om2.kilometer
            ) : '') +
            valueNode('humidity', data.humidity, om2.percent) +
            (data.wind_direction === '0' || data.wind_direction === '990' ? '' : valueNode(
                'windDirection',
                parseInt(data.wind_direction) % 360,
                om2.degree
            )) +
            valueNode('windSpeed', parseInt(data.wind_speed) / 10, om2.meterPerSecond) +
            valueNode('windGusts', parseInt(data.wind_gusts) / 10, om2.meterPerSecond) +
            valueNode('sunTime', parseInt(data.sun_time) * 6, om2.minute) +
            valueNode('sunTotal', parseInt(data.sun_total) / 100, om2.megaJoulePerSquareMeter) +
            valueNode('rainTime', parseInt(data.rain_time) * 6, om2.minute) +
            valueNode(
                'rainTotal',
                data.rain_total === '-1' ? 0 : parseInt(data.rain_total) / 10,
                om2.millimeter
            ) +
            `<hasFog ${rdf.boolean}>${data.fog === '1' ? 'true' : 'false'}</hasFog>\n` +
            `<hasIcing ${rdf.boolean}>${data.icing === '1' ? 'true' : 'false'}</hasIcing>\n` +
            `<hasLightning ${rdf.boolean}>${data.lightning === '1' ? 'true' : 'false'}</hasLightning>\n` +
            `<hasRain ${rdf.boolean}>${data.rain === '1' ? 'true' : 'false'}</hasRain>\n` +
            `<hasSnow ${rdf.boolean}>${data.snow === '1' ? 'true' : 'false'}</hasSnow>\n` +
            `</owl:NamedIndividual>\n`,
            res
        ));
    });

    await new Promise(res => output.write(CLOSE, res));
    await output.end();
})();

function blankNode(relation: string, content: string): string {
    return `<${relation}><_>${content}</_></${relation}>\n`;
}

function relation(relation: string, resource: string): string {
    return `<${relation} rdf:resource="${resource}"/>\n`
}

function valueNode(type: string, value: any, unit: string): string {
    return blankNode(
        type,
        `<value>${value}</value>\n` +
        relation('unit', unit)
    )
}