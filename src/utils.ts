/**
 * Utility functions for TOON package
 */

import { EncodeOptions } from './types';

/**
 * Check if an array is uniform (all elements are objects with same keys)
 */
export function isUniformObjectArray(arr: any[]): boolean {
  if (arr.length === 0 || !Array.isArray(arr)) return false;
  
  const first = arr[0];
  if (typeof first !== 'object' || first === null || Array.isArray(first)) {
    return false;
  }
  
  const firstKeys = Object.keys(first).sort();
  
  for (let i = 1; i < arr.length; i++) {
    const item = arr[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return false;
    }
    const keys = Object.keys(item).sort();
    if (keys.length !== firstKeys.length || 
        !keys.every((k, idx) => k === firstKeys[idx])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all unique keys from array of objects
 */
export function getObjectKeys(arr: any[]): string[] {
  const keysSet = new Set<string>();
  for (const item of arr) {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      Object.keys(item).forEach(key => keysSet.add(key));
    }
  }
  return Array.from(keysSet).sort();
}

/**
 * Check for circular references
 */
export function hasCircularReference(obj: any): boolean {
  const seen = new WeakSet();
  
  function check(obj: any): boolean {
    if (obj === null || typeof obj !== 'object') {
      return false;
    }
    
    if (seen.has(obj)) {
      return true;
    }
    
    seen.add(obj);
    
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (check(item)) return true;
      }
    } else {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (check(obj[key])) return true;
        }
      }
    }
    
    seen.delete(obj);
    return false;
  }
  
  return check(obj);
}

/**
 * Get default options with fallbacks
 */
export function getEncodeOptions(options?: EncodeOptions): Required<EncodeOptions> {
  return {
    delimiter: options?.delimiter ?? ',',
    pretty: options?.pretty ?? true,
    strictArrays: options?.strictArrays ?? false,
    minTabularLength: options?.minTabularLength ?? 2,
  };
}

