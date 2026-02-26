import type { DataRange } from "../../types";
import { findMatchInRange } from '../../utils/matchUtils';

interface LineReferenceData<T> {
  processed: boolean
  data: DataRange<T>[]
}

export interface LineReferenceSnapshot<T> {
  processed: boolean;
  data: DataRange<T>[];
}

/**
 * Line reference cache is expected to be populated in a sequential manner where one data always comes in 
 * assuming lower line number to higher line number (like how the lines are read for a file)
 * The line reference cache is used to retrieve some data given a line number and a file uri
 * For example, finding out which script block your are in on a given line number in a file
 * Note: it does not automatically support data which can be nested, such as nested switch statements 
 *       unless you manually handle the inputs carefully (i.e. if a switch has a nested switch inside of it
 *       you will need 2 entries. One for the first part, one for the second part after the nested switch)
 */
export class LineReferenceCache<T> {
  private cache: LineReferenceData<T>;

  constructor() {
    this.cache = getDefault();
  }

  /**
   * Add a new data range to the cache, we add the data value and the start line, the end lines will be processed on retrieval
   * @param startLine the start line of the data
   * @param data the data itself to be returned when requesting data for a line
   */
  put(startLine: number, data: T): void {
    if (!data) return;
    const dataRanges = this.cache.data;
    dataRanges.push({ start: startLine, end: -1, data: data });
    this.cache.data = dataRanges;
  }

  /**
   * Returns the data at a particular line number in a particular file, if exists.
   * This method can be used even if the cache is not fully completed yet and still being built (sequentially).
   * @param lineNum the line number to check what data it belongs to
   * @returns the data found, if any
   */
  get(lineNum: number): T | undefined {
    const cacheItem = this.cache;
    let match: DataRange<T> | undefined;
    for (const range of cacheItem.data) {
      if (lineNum < range.start) break;
      match = range;
    }
    return match?.data;
  }

  /**
   * Returns the data with its start and end line numbers at a particular line number in a particular file, if exists.
   * This method can only be used when the cache data is complete for the file.
   * @param lineNum the line number to check what data it belongs to
   * @returns the data with its start and end indexes
   */
  getWithRange(lineNum: number): DataRange<T> | undefined {
    return findMatchInRange(lineNum, this.processIfNeeded()?.data);
  }

  /**
   * Process the cache data ranges to build the end values
   */
  processIfNeeded(): LineReferenceData<T> | undefined {
    const cacheItem = this.cache;
    if (!cacheItem.processed) {
      cacheItem.data.sort((a, b) => a.start - b.start);
      for (let i = 0; i < cacheItem.data.length; i++) {
        cacheItem.data[i].end = (cacheItem.data[i + 1]?.start ?? 100000) - 1;
      }
      cacheItem.processed = true;
    }
    return cacheItem;
  }

  /**
   * Clear the line reference values of all files in the cache
   */
  clear(): void {
    this.cache = getDefault();
  }

  snapshot(): LineReferenceSnapshot<T> {
    return {
      processed: this.cache.processed,
      data: [...this.cache.data]
    };
  }

  restore(snapshot: LineReferenceSnapshot<T>): void {
    this.cache = {
      processed: snapshot.processed,
      data: [...snapshot.data]
    };
  }
}

function getDefault(): LineReferenceData<any> {
  return { processed: false, data: [] };
}
