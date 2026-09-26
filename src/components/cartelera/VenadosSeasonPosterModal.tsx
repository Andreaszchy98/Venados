import React from 'react';

export interface VenadosSeasonPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VenadosSeasonPosterModal: React.FC<VenadosSeasonPosterModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return null;
};

export default VenadosSeasonPosterModal;
