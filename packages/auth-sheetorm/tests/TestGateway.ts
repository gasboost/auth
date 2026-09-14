type MutableSheetRecords = {
  getValues(): Record<string, unknown>[];
  replace(record: Record<string, unknown>): void;
  remove(primaryKeyValue: unknown): void;
};

type DataStoreTable = {
  dbId: string;
  sheetName: string;
};

export class TestGateway {
  public readonly records = new Map<string, Record<string, unknown>[]>();

  public currentTable = "";

  public table(sheetName: string, dbId: string): void {
    this.currentTable = `${dbId}:${sheetName}`;

    if (!this.records.has(this.currentTable)) {
      this.records.set(this.currentTable, []);
    }
  }

  public read(): Record<string, unknown>[] {
    return this.cloneRecords(this.records.get(this.currentTable) ?? []);
  }

  public readMany(
    tables: readonly DataStoreTable[],
  ): Map<string, Record<string, unknown>[]> {
    return new Map(
      tables.map(({ dbId, sheetName }) => {
        const tableKey = `${dbId}:${sheetName}`;

        return [tableKey, this.cloneRecords(this.records.get(tableKey) ?? [])];
      }),
    );
  }

  public insert(records: Record<string, unknown>[]): void {
    const current = this.records.get(this.currentTable) ?? [];

    current.push(...this.cloneRecords(records));

    this.records.set(this.currentTable, current);
  }

  public update(
    records: Record<string, unknown>[],
    currentRecords: MutableSheetRecords,
    _primaryKey: string,
  ): void {
    records.forEach((record) => {
      currentRecords.replace({
        ...record,
      });
    });

    this.records.set(
      this.currentTable,
      this.cloneRecords(currentRecords.getValues()),
    );
  }

  public delete(
    primaryKeyValues: readonly unknown[],
    currentRecords: MutableSheetRecords,
    _primaryKey: string,
  ): void {
    primaryKeyValues.forEach((primaryKeyValue) => {
      currentRecords.remove(primaryKeyValue);
    });

    this.records.set(
      this.currentTable,
      this.cloneRecords(currentRecords.getValues()),
    );
  }

  public rewrite(
    records: Record<string, unknown>[],
    _previousRecords?: Record<string, unknown>[],
  ): void {
    this.records.set(this.currentTable, this.cloneRecords(records));
  }

  public setColumns(
    _dbId: string,
    _sheetName: string,
    _columns: string[],
  ): void {}

  public count(): number {
    return (this.records.get(this.currentTable) ?? []).length;
  }

  public lastId(primaryKey: string): number {
    const records = this.records.get(this.currentTable) ?? [];

    return records.reduce((max, record) => {
      const value = record[primaryKey];

      return typeof value === "number" ? Math.max(max, value) : max;
    }, 0);
  }

  public protect(): void {}

  private cloneRecords(
    records: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    return records.map((record) => ({
      ...record,
    }));
  }
}
