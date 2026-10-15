import {serialize,deserialize} from './model.js';
/** Single-key commit; previous good snapshot is retained. Storage errors are never swallowed. */
export function repository(storage,key='pilot20:session:v1') {
  return {
    load() {
      const raw=storage.getItem(key); if (raw === null) return null;
      try {return {state:deserialize(raw),recovered:false};}
      catch (error) {
        const backup=storage.getItem(key+':last-good');
        if (backup === null) throw error;
        return {state:deserialize(backup),recovered:true,error: error.message};
      }
    },
    save(state) {
      const next=serialize(state), old=storage.getItem(key);
      if (old !== null) {deserialize(old); storage.setItem(key+':last-good',old);}
      storage.setItem(key,next);
    },
    export(state) {return serialize(state);},
    import(raw) {return deserialize(raw);}
  };
}
