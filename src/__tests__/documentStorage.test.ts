import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { documentRepository } from '../storage/documentRepository';

describe('DocumentRepository IndexedDB', () => {
  const profileId = 'prof_idb_test_1';

  it('saves primary PDF document and retrieves metadata', async () => {
    const fakeBlob = new Blob(['%PDF-1.4 binary mock data'], { type: 'application/pdf' });
    const metadata = await documentRepository.saveDocument(
      profileId,
      fakeBlob,
      'primary_passport.pdf',
      'primary',
      0
    );

    expect(metadata.fileName).toBe('primary_passport.pdf');
    expect(metadata.role).toBe('primary');
    expect(metadata.orderIndex).toBe(0);

    const docs = await documentRepository.getDocumentsByProfileId(profileId);
    expect(docs.length).toBe(1);
    expect(docs[0].id).toBe(metadata.id);
  });

  it('saves additional documents and retrieves in correct upload order', async () => {
    const fakeBlob1 = new Blob(['doc 1'], { type: 'application/pdf' });
    const fakeBlob2 = new Blob(['doc 2'], { type: 'application/pdf' });

    // Save in reverse order to test sorting logic
    await documentRepository.saveDocument(profileId, fakeBlob2, 'child2.pdf', 'additional', 2);
    await documentRepository.saveDocument(profileId, fakeBlob1, 'child1.pdf', 'additional', 1);

    const docs = await documentRepository.getDocumentsByProfileId(profileId);
    expect(docs.length).toBe(3); // 1 primary + 2 additionals
    expect(docs[0].role).toBe('primary');
    expect(docs[0].orderIndex).toBe(0);
    expect(docs[1].fileName).toBe('child1.pdf');
    expect(docs[1].orderIndex).toBe(1);
    expect(docs[2].fileName).toBe('child2.pdf');
    expect(docs[2].orderIndex).toBe(2);
  });

  it('retrieves binary Blob from IndexedDB', async () => {
    const docs = await documentRepository.getDocumentsByProfileId(profileId);
    const primaryDoc = docs[0];

    const binaryBlob = await documentRepository.getDocumentBinary(primaryDoc.id);
    expect(binaryBlob).not.toBeNull();
    expect(binaryBlob?.type).toBe('application/pdf');

    const text = await binaryBlob?.text();
    expect(text).toContain('%PDF-1.4 binary mock data');
  });

  it('deletes document cleanly from IndexedDB', async () => {
    const docsBefore = await documentRepository.getDocumentsByProfileId(profileId);
    const toDelete = docsBefore.find((d) => d.fileName === 'child2.pdf');

    expect(toDelete).toBeDefined();
    await documentRepository.deleteDocument(toDelete!.id);

    const docsAfter = await documentRepository.getDocumentsByProfileId(profileId);
    expect(docsAfter.length).toBe(docsBefore.length - 1);
    expect(docsAfter.some((d) => d.id === toDelete!.id)).toBe(false);
  });
});
