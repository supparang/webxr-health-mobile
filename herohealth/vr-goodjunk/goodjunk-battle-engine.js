(() => {
  'use strict';

  const W = window;
  const D = document;

  if (W.__GJ_BATTLE_ENGINE_LOADED__) return;
  W.__GJ_BATTLE_ENGINE_LOADED__ = true;

  const ROOM_KINDS = ['battleRooms',