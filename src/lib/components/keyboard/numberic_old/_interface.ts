export type NumbericKey =
	| number
	| 'PrevField'
	| 'NextField'
	| 'Done'
	| 'AC'
	| '+'
	| '-'
	| '*'
	| ':'
	| '%'
	| '('
	| ')'
	| 'Del'
	| '='
	| '.';
export interface KeyboardNumberic {
	output?: (value: NumbericKey) => void;
	doneButtonEnabled?: boolean;
	otherFieldsButtonEnabled?: boolean;
	disableKeys?: NumbericKey[];
}
