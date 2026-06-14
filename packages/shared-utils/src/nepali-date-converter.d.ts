declare module 'nepali-date-converter' {
    export default class NepaliDate {
        constructor(date?: Date | string | number);
        format(pattern: string): string;
    }
}
