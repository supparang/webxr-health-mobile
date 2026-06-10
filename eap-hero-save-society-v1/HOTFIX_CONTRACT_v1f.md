# HOTFIX_CONTRACT_v1f

แก้บั๊ก:
`Uncaught ReferenceError: contract is not defined at Object.startBoss`

สาเหตุ:
ใน v1e ตอน merge Balanced Item Bank ทับส่วน `startBoss()` ทำให้ตัวแปร `contract`
ไม่ได้ถูกประกาศก่อนนำไปใช้กับ `contract.hpBonus` และ `contract.hearts`.

แก้ไข:
เพิ่มกลับเข้าไปใน `startBoss(id, contractName)`:

```js
const contract = getContract(contractName || 'normal');
const seconds = Math.max(45, Math.round(difficultySeconds() * contract.timeFactor));
```

และเพิ่ม `contract: contract.key` ใน `state.active`.
